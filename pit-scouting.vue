<template>
  <div class="min-h-screen bg-gray-100 py-12 px-4 sm:px-6 lg:px-8">
    <div
      class="max-w-4xl mx-auto bg-white shadow-md rounded-lg overflow-hidden"
    >
      <div class="px-4 py-5 sm:p-6">
        <h1 class="text-center text-3xl font-bold text-gray-900 mb-8">
          Pit-Scouting Form
        </h1>

        <!-- Tabs -->
        <div class="p-4 bg-fuchsia-50 rounded-md">
          <div class="flex flex-wrap gap-2 mb-2">
            <button
              v-for="(tab, index) in tabs"
              :key="index"
              @click="switchTab(index)"
              class="px-4 py-2 rounded-md text-sm font-medium"
              :class="
                currentTab === index
                  ? 'bg-blue-100 text-blue-600 border-2 border-blue-500'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300 border-2 border-gray-400'
              "
            >
              {{ tab.name }}
              <Icon
                icon="mdi:close"
                class="ml-2 inline-block"
                @click.stop="confirmRemoveTab(index)"
              />
            </button>
            <button
              @click="addTab"
              class="ml-2 px-4 py-2 rounded-md text-sm font-medium border-2 border-green-500 bg-green-100 text-green-700 hover:bg-green-200"
            >
              <Icon icon="mdi:plus" class="w-5 h-5 mr-1 inline-block" />
              Add Tab
            </button>
          </div>

          <div class="mt-2">
            <button
              @click="confirmClearCurrentTab"
              class="px-4 py-2 rounded-md text-sm font-medium border-2 border-red-500 bg-red-100 text-red-600 hover:bg-red-200"
            >
              <Icon icon="mdi:refresh" class="mr-2 inline-block" />
              Clear Current Tab
            </button>
            <button
              v-if="showDebugButton"
              class="ml-2 px-4 py-2 rounded-md text-sm font-medium border-4 border-amber-500/100 bg-yellow-100 text-yellow-700 hover:bg-yellow-200"
              @click="confirmDebugAction"
            >
              Debug
            </button>
          </div>
        </div>

        <!-- Event ID and Form ID -->
        <div class="flex flex-col my-4">
          <div class="mb-4">
            <span class="text-sm font-medium text-gray-500">Event ID:</span>
            <span
              class="max-[640px]:text-xs ml-2 px-2 py-1 bg-blue-100 text-blue-800 rounded-md"
              >{{ eventId }}</span
            >
          </div>
          <div>
            <span class="text-sm font-medium text-gray-500">Form ID:</span>
            <span
              class="max-[640px]:text-[10px] ml-2 px-2 py-1 bg-green-100 text-green-800 rounded-md"
              >{{ currentFormId }}</span
            >
          </div>
        </div>

        <form @submit.prevent="confirmSubmitForm">
          <div
            v-for="(field, index) in formFields"
            :key="index"
            class="mb-8 max-[640px]:mb-4 bg-gray-50 p-6 rounded-lg shadow-sm"
          >
            <div v-if="field.type !== 'hidden'" class="mb-2">
              <label
                :for="'field-' + index"
                class="block text-lg font-semibold text-gray-900 mb-2"
              >
                {{ field.question }}
                <span v-if="field.required" class="text-red-500">*</span>
              </label>

              <div v-if="field.i" class="mt-4">
                <button
                  @click="toggleDescription(index)"
                  type="button"
                  class="w-full text-left px-4 py-2 bg-blue-100 hover:bg-blue-200 text-blue-800 rounded-md transition-colors duration-200 flex items-center justify-between"
                >
                  <span
                    >{{
                      field.showDescription ? "Hide" : "Show"
                    }}
                    Description</span
                  >
                  <Icon
                    :icon="
                      field.showDescription
                        ? 'mdi:chevron-up'
                        : 'mdi:chevron-down'
                    "
                  />
                </button>
                <transition name="fade">
                  <div
                    v-if="field.showDescription"
                    class="mt-2 bg-white p-4 rounded-md border border-blue-200"
                  >
                    <img
                      :src="field.i"
                      :alt="field.question"
                      :style="{ width: field.w || '100%' }"
                      class="rounded-lg mb-4"
                    />
                    <p class="text-sm text-gray-600">
                      {{
                        field.description ||
                        "No additional description available."
                      }}
                    </p>
                  </div>
                </transition>
              </div>

              <div v-if="field.type === 'radio'" class="mt-4">
                <div
                  v-for="(option, optionIndex) in field.options"
                  :key="optionIndex"
                  class="flex items-center mb-2"
                >
                  <input
                    :id="'field-' + index + '-' + optionIndex"
                    :type="field.type"
                    :name="'field-' + index"
                    :value="option"
                    v-model="field.value"
                    :required="field.required"
                    class="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300"
                    @change="saveFormData"
                  />
                  <label
                    :for="'field-' + index + '-' + optionIndex"
                    class="ml-2 block text-sm text-gray-900"
                  >
                    {{ option }}
                  </label>
                </div>
                <div v-if="field.value === 'Other'" class="mt-2">
                  <input
                    v-model="field.otherValue"
                    type="text"
                    :placeholder="
                      'Specify other ' + field.question.toLowerCase()
                    "
                    class="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                    @input="saveFormData"
                  />
                </div>
              </div>

              <div v-else-if="field.type === 'checkbox'" class="mt-4">
                <div
                  v-for="(option, optionIndex) in field.options"
                  :key="optionIndex"
                  class="flex items-center mb-2"
                >
                  <input
                    :id="'field-' + index + '-' + optionIndex"
                    type="checkbox"
                    :value="option"
                    v-model="field.value"
                    class="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                    @change="saveFormData"
                  />
                  <label
                    :for="'field-' + index + '-' + optionIndex"
                    class="ml-2 block text-sm text-gray-900"
                  >
                    {{ option }}
                  </label>
                </div>
                <div
                  v-if="
                    Array.isArray(field.value) && field.value.includes('Other')
                  "
                  class="mt-2"
                >
                  <input
                    v-model="field.otherValue"
                    type="text"
                    :placeholder="
                      'Specify other ' + field.question.toLowerCase()
                    "
                    class="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                    @input="saveFormData"
                  />
                </div>
              </div>

              <div
                v-else-if="field.type === 'autocomplete'"
                class="mt-1 relative"
              >
                <input
                  :id="'field-' + index"
                  type="text"
                  v-model="field.value"
                  :required="field.required"
                  @input="handleTeamNumberInput"
                  @blur="hideTeamSuggestions"
                  class="block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                  :class="{ 'border-red-500': field.error }"
                  :placeholder="'Enter team number'"
                />
                <div
                  v-if="showTeamSuggestions"
                  class="absolute z-10 mt-1 w-full bg-white shadow-lg max-h-60 rounded-md py-1 text-base ring-1 ring-black ring-opacity-5 overflow-auto focus:outline-none sm:text-sm"
                >
                  <div
                    v-for="team in filteredTeamSuggestions"
                    :key="team.team_number"
                    @mousedown.prevent="selectTeam(team)"
                    class="cursor-pointer select-none relative py-2 pl-3 pr-9 hover:bg-gray-100"
                  >
                    <div class="flex items-center">
                      <span class="font-normal truncate"
                        >{{ team.team_number }} - {{ team.team_name }}</span
                      >
                    </div>
                  </div>
                </div>
                <p v-if="field.error" class="mt-2 text-sm text-red-600">
                  {{ field.error }}
                </p>
              </div>

              <input
                v-else-if="field.type === 'text' || field.type === 'number'"
                :id="'field-' + index"
                :type="field.type"
                v-model="field.value"
                :required="field.required"
                class="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                :class="{ 'border-red-500': field.error }"
                @input="saveFormData"
                @blur="validateField(field)"
              />

              <textarea
                v-else-if="field.type === 'textarea'"
                :id="'field-' + index"
                v-model="field.value"
                :required="field.required"
                rows="3"
                class="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                :class="{ 'border-red-500': field.error }"
                @input="saveFormData"
                @blur="validateField(field)"
              ></textarea>

              <p v-if="field.error" class="mt-2 text-sm text-red-600">
                {{ field.error }}
              </p>
            </div>
          </div>

          <!-- Image upload sections -->
          <div class="mb-8 bg-gray-50 p-6 rounded-lg shadow-sm">
            <h2 class="text-xl font-semibold text-gray-900 mb-4">
              Full Robots Images
            </h2>
            <div
              @dragover.prevent
              @drop.prevent="handleDrop('fullRobot', $event)"
              class="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center cursor-pointer hover:border-indigo-500 transition-colors duration-300"
            >
              <input
                type="file"
                accept="image/*"
                @change="handleFileSelect('fullRobot', $event)"
                class="hidden"
                ref="fullRobotInput"
                multiple
              />
              <button
                type="button"
                @click="$refs.fullRobotInput.click()"
                class="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                <Icon icon="mdi:upload" class="mr-2" />
                Select Files
              </button>
              <p class="mt-2 text-sm text-gray-500">or drag and drop</p>
              <p class="mt-1 text-xs text-gray-500">
                PNG, JPG, JPEG, HEIC, GIF up to 50MB each
              </p>
            </div>
            <div
              v-if="fullRobotImages.length > 0"
              class="mt-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4"
            >
              <div
                v-for="(image, index) in fullRobotImages"
                :key="index"
                class="relative bg-white p-2 rounded-lg shadow"
              >
                <img
                  :src="image.url"
                  :alt="image.name"
                  class="w-full h-32 object-cover rounded-lg"
                />
                <div class="mt-2 text-xs text-gray-600 truncate">
                  {{ image.name }}
                </div>
                <div class="text-xs text-gray-500">
                  {{ formatFileSize(image.size) }}
                </div>
                <button
                  @click="confirmRemoveImage('fullRobot', index)"
                  class="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 hover:bg-red-600 focus:outline-none"
                >
                  <Icon icon="mdi:close" />
                </button>
              </div>
            </div>
          </div>

          <div class="mb-8 bg-gray-50 p-6 rounded-lg shadow-sm">
            <h2 class="text-xl font-semibold text-gray-900 mb-4">
              Drive Train Images
            </h2>
            <div
              @dragover.prevent
              @drop.prevent="handleDrop('driveTrain', $event)"
              class="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center cursor-pointer hover:border-indigo-500 transition-colors duration-300"
            >
              <input
                type="file"
                accept="image/*"
                @change="handleFileSelect('driveTrain', $event)"
                class="hidden"
                ref="driveTrainInput"
                multiple
              />
              <button
                type="button"
                @click="$refs.driveTrainInput.click()"
                class="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                <Icon icon="mdi:upload" class="mr-2" />
                Select Files
              </button>
              <p class="mt-2 text-sm text-gray-500">or drag and drop</p>
              <p class="mt-1 text-xs text-gray-500">
                PNG, JPG, JPEG, HEIC, GIF up to 50MB each
              </p>
            </div>
            <div
              v-if="driveTrainImages.length > 0"
              class="mt-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4"
            >
              <div
                v-for="(image, index) in driveTrainImages"
                :key="index"
                class="relative bg-white p-2 rounded-lg shadow"
              >
                <img
                  :src="image.url"
                  :alt="image.name"
                  class="w-full h-32 object-cover rounded-lg"
                />
                <div class="mt-2 text-xs text-gray-600 truncate">
                  {{ image.name }}
                </div>
                <div class="text-xs text-gray-500">
                  {{ formatFileSize(image.size) }}
                </div>
                <button
                  @click="confirmRemoveImage('driveTrain', index)"
                  class="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 hover:bg-red-600 focus:outline-none"
                >
                  <Icon icon="mdi:close" />
                </button>
              </div>
            </div>
          </div>

          <div class="mt-8">
            <button
              type="submit"
              class="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              <Icon icon="mdi:send" class="mr-2" />
              Submit Questionnaire
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch, computed } from "vue";
import { Icon } from "@iconify/vue";
import { v4 as uuidv4 } from "uuid";
import Swal from "sweetalert2";

interface FormField {
  question: string;
  type: string;
  required: boolean;
  value: any;
  options?: string[];
  i?: string;
  w?: string;
  showOtherInput?: boolean;
  otherValue?: string;
  showDescription?: boolean;
  description?: string;
  error?: string;
}

interface Tab {
  name: string;
  formData: FormField[];
  formId: string;
}

interface ImageData {
  url: string;
  name: string;
  size: number;
}

interface Team {
  team_number: string;
  team_name: string;
}

interface FormField {
  value: any;
  error?: string;
}

const tabs = ref<Tab[]>([{ name: "Tab 1", formData: [], formId: uuidv4() }]);
const currentTab = ref(0);
const eventId = ref("");

const currentFormId = computed(() => tabs.value[currentTab.value].formId);

const formFields = ref<FormField[]>([
  {
    question: "Team number",
    type: "autocomplete",
    required: true,
    value: null,
  },
  {
    i: "https://lh7-us.googleusercontent.com/pUWvHrPDa5IfrQcFalk4lO0e4PhD3sLMP0jyLJU8PTWWGfw5r-Wa4qDQNHhbu0byYLzXScP5lfTSUCsvbNI-FlwDY2L7Ra0-TgYqf5Eabw0INSFE3ah4QCqCqHFrsaPKyCOt8m2Yo-H2ie9E7apzh6c8AO147A",
    w: "50%",
    question: "Type of drive train",
    type: "radio",
    options: [
      'Tank Drive ("skid steer", plates on both sides of wheels)',
      "West Coast Drive (wheels mounted off one side of tube)",
      "Swerve Drive",
      "Other",
    ],
    value: null,
    required: true,
    showOtherInput: false,
    otherValue: "",
    showDescription: false,
    description: "Select the type of drive train used in your robot design.",
  },
  {
    i: "https://lh7-us.googleusercontent.com/PCI7CaG88MiY50L7AM0CVTs9dRd3NQgqW4B2rd64vmjHaNDMEHR0EkWYqv-rzHBnGBC08NzWtr7W97lIk226Q9WVCPuTKuOSZcpb6eyNC5Q3HGmFQwp8005gRcxiS09RjeWUJQJTK-vQGDWd0QAbpSipLSkExw",
    w: "100%",
    question: "Type of wheels used",
    type: "radio",
    options: [
      "Traction",
      "Mecanum (rollers at 45° angle)",
      "Omni (rollers at 90° angle)",
      "Other",
    ],
    value: null,
    required: true,
    showOtherInput: false,
    otherValue: "",
    showDescription: false,
    description: "Choose the type of wheels used on your robot.",
  },
  {
    question: "Intake Use:",
    type: "checkbox",
    options: ["Ground", "Station", "None", "Other"],
    value: [],
    required: true,
    showOtherInput: false,
    otherValue: "",
  },
  {
    question: "Scoring Locations:",
    type: "checkbox",
    options: ["Amp", "Speaker", "Trap", "Hang", "Harmony", "None", "Other"],
    value: [],
    required: true,
    showOtherInput: false,
    otherValue: "",
  },
  {
    question: "Robot Weight (in pounds)",
    type: "number",
    required: true,
    value: null,
  },
  {
    question:
      "Robot Dimension (Length in Inches) without bumpers - front to back",
    type: "number",
    required: true,
    value: null,
  },
  {
    question:
      "Robot Dimension (Width in Inches) without bumpers - left to right",
    type: "number",
    required: true,
    value: null,
  },
  {
    question:
      "Robot Dimension (Height in Inches) from floor to highest point on robot at the start of the match",
    type: "number",
    required: true,
    value: null,
  },
  {
    question: "Drive Team Members",
    type: "radio",
    options: [
      "One person driving and operating the robot during a match",
      "Other",
    ],
    value: null,
    required: true,
    showOtherInput: false,
    otherValue: "",
  },
  {
    question: "Maneuverability",
    type: "checkbox",
    options: ["Can it drive under the core", "Other"],
    value: [],
    required: false,
    showOtherInput: false,
    otherValue: "",
  },
  {
    question: "Height when fully extended (in inches)",
    type: "number",
    required: true,
    value: null,
  },
  {
    question: "Hours/Weeks of Practice",
    type: "text",
    required: true,
    value: null,
  },
  {
    question: "Additional Comments",
    type: "textarea",
    required: false,
    value: null,
  },
]);

const fullRobotImages = ref<ImageData[]>([]);
const driveTrainImages = ref<ImageData[]>([]);
const teamSuggestions = ref<any[]>([]);
const showTeamSuggestions = ref(false);
const showDebugButton = ref(false);

onMounted(async () => {
  await loadTeams();
  await loadEventId();
  const isNewUser = !localStorage.getItem("surveyTabs");
  if (isNewUser) {
    saveToLocalStorage();
  } else {
    loadFromLocalStorage();
  }
});

const checkDebugInput = () => {
  const teamNumberField = formFields.value.find(field => field.question === 'Team number');
  if (teamNumberField) {
    showDebugButton.value = teamNumberField.value === 'debug';
  }
};

const handleTeamNumberInput = (event: Event) => {
  const input = event.target as HTMLInputElement;
  const teamNumberField = formFields.value.find(field => field.question === 'Team number');
  if (teamNumberField) {
    teamNumberField.value = input.value;
  }
  checkDebugInput();
  searchTeams();
};

const confirmDebugAction = () => {
  Swal.fire({
    title: "Debug Action",
    text: "Are you sure you want to clear all local storage and cache? This action cannot be undone.",
    icon: "warning",
    showCancelButton: true,
    confirmButtonColor: "#d33",
    cancelButtonColor: "#3085d6",
    confirmButtonText: "Yes, clear it!",
    reverseButtons: true,
  }).then((result) => {
    if (result.isConfirmed) {
      clearLocalStorageAndRefresh();
    }
  });
};

const clearLocalStorageAndRefresh = () => {
  // 清除所有 localStorage 内容
  localStorage.clear();

  // 清除缓存
  if ('caches' in window) {
    caches.keys().then((names) => {
      names.forEach((name) => {
        caches.delete(name);
      });
    });
  }

  // 强制刷新页面
  location.reload();
};

const loadEventId = async () => {
  try {
    const response = await fetch("https://api.frc695.com/api/event/event-id");
    const data = await response.json();
    eventId.value = data.eventId;
  } catch (error) {
    console.error("Error loading event ID:", error);
  }
};

const filteredTeamSuggestions = computed(() => {
  const query = formFields.value[0].value.toLowerCase();
  return teamSuggestions.value.filter(
    (team) =>
      team.team_number.includes(query) ||
      team.team_name.toLowerCase().includes(query)
  );
});

watch(
  [tabs, currentTab],
  () => {
    saveToLocalStorage();
  },
  { deep: true }
);

const addTab = () => {
  const newTab: Tab = {
    name: `Tab ${tabs.value.length + 1}`,
    formData: JSON.parse(
      JSON.stringify(
        formFields.value.map((field) => ({
          ...field,
          value: null,
          error: undefined,
        }))
      )
    ),
    formId: uuidv4(),
  };
  tabs.value.push(newTab);
  switchTab(tabs.value.length - 1);
  saveToLocalStorage(); // 确保新标签页添加后立即保存到本地存储
};

const confirmRemoveTab = (index: number) => {
  Swal.fire({
    title: "Are you sure?",
    text: "You are about to delete this tab. This action cannot be undone.",
    icon: "warning",
    showCancelButton: true,
    confirmButtonColor: "#d33",
    cancelButtonColor: "#3085d6",
    confirmButtonText: "Yes, delete it!",
    reverseButtons: true,
  }).then((result) => {
    if (result.isConfirmed) {
      Swal.fire({
        title: "Confirm Deletion",
        text: "Are you absolutely sure you want to delete this tab?",
        icon: "warning",
        showCancelButton: true,
        confirmButtonColor: "#d33",
        cancelButtonColor: "#3085d6",
        confirmButtonText: "Delete",
        cancelButtonText: "Cancel",
      }).then((secondResult) => {
        if (secondResult.isConfirmed) {
          removeTab(index);
          Swal.fire("Deleted!", "The tab has been deleted.", "success");
        }
      });
    }
  });
};

const removeTab = (index: number) => {
  const removedTab = tabs.value[index];
  tabs.value.splice(index, 1);

  if (tabs.value.length === 0) {
    addTab();
  } else if (currentTab.value >= tabs.value.length) {
    currentTab.value = tabs.value.length - 1;
  }

  switchTab(currentTab.value);

  // Remove localStorage data for the deleted tab
  localStorage.removeItem(`formData_${removedTab.formId}`);
  localStorage.removeItem(`fullRobotImages_${removedTab.formId}`);
  localStorage.removeItem(`driveTrainImages_${removedTab.formId}`);
};

const switchTab = (index: number) => {
  currentTab.value = index;
  formFields.value = JSON.parse(JSON.stringify(tabs.value[index].formData));
  loadImagesFromLocalStorage();
  checkDebugInput();
};

const confirmClearCurrentTab = () => {
  Swal.fire({
    title: "Are you sure?",
    text: "You are about to clear all data in the current tab. This action cannot be undone.",
    icon: "warning",
    showCancelButton: true,
    confirmButtonColor: "#d33",
    cancelButtonColor: "#3085d6",
    confirmButtonText: "Yes, clear it!",
    reverseButtons: true,
  }).then((result) => {
    if (result.isConfirmed) {
      Swal.fire({
        title: "Confirm Clearing",
        text: "Are you absolutely sure you want to clear all data in this tab?",
        icon: "warning",
        showCancelButton: true,
        confirmButtonColor: "#d33",
        cancelButtonColor: "#3085d6",
        confirmButtonText: "Clear",
        cancelButtonText: "Cancel",
      }).then((secondResult) => {
        if (secondResult.isConfirmed) {
          clearCurrentTab();
          Swal.fire("Cleared!", "The tab data has been cleared.", "success");
        }
      });
    }
  });
};

const clearCurrentTab = () => {
  tabs.value[currentTab.value].formData = JSON.parse(
    JSON.stringify(
      formFields.value.map((field) => ({
        ...field,
        value: null,
        error: undefined,
      }))
    )
  );
  formFields.value = tabs.value[currentTab.value].formData;
  fullRobotImages.value = [];
  driveTrainImages.value = [];
  saveFormData();
};

const toggleDescription = (index: number) => {
  formFields.value[index].showDescription =
    !formFields.value[index].showDescription;
};

const searchTeams = () => {
  showTeamSuggestions.value = true;
};

const selectTeam = (team: Team) => {
  formFields.value[0].value = team.team_number;
  showTeamSuggestions.value = false;
};

// const searchTeams = async () => {
//   // Simulated API call for team suggestions
//   const mockTeams = [
//     { number: '254', name: 'The Cheesy Poofs', avatar: 'https://example.com/team254.jpg' },
//     { number: '1114', name: 'Simbotics', avatar: 'https://example.com/team1114.jpg' },
//     // Add more mock teams as needed
//   ]
//   teamSuggestions.value = mockTeams.filter(team => team.number.includes(formFields.value[0].value) || team.name.toLowerCase().includes(formFields.value[0].value.toLowerCase()))
//   showTeamSuggestions.value = teamSuggestions.value.length > 0
// }

const loadTeams = async () => {
  try {
    const response = await fetch("https://api.frc695.com/api/team/teams");
    const data = await response.json();
    teamSuggestions.value = data;
  } catch (error) {
    console.error("Error loading teams:", error);
  }
};

const hideTeamSuggestions = () => {
  setTimeout(() => {
    showTeamSuggestions.value = false;
  }, 200);
};

const handleFileSelect = async (
  type: "fullRobot" | "driveTrain",
  event: Event
) => {
  const files = (event.target as HTMLInputElement).files;
  if (files) {
    for (let i = 0; i < files.length; i++) {
      if (isAllowedImageType(files[i])) {
        await uploadImage(type, files[i]);
      } else {
        Swal.fire(
          "Invalid File Type",
          "Please upload only JPEG, PNG, or GIF images.",
          "error"
        );
      }
    }
  }
};

const handleDrop = async (
  type: "fullRobot" | "driveTrain",
  event: DragEvent
) => {
  event.preventDefault();
  const files = event.dataTransfer?.files;
  if (files) {
    for (let i = 0; i < files.length; i++) {
      if (isAllowedImageType(files[i])) {
        await uploadImage(type, files[i]);
      } else {
        Swal.fire(
          "Invalid File Type",
          "Please upload only JPEG, PNG, or GIF images.",
          "error"
        );
      }
    }
  }
};

const uploadImage = async (type: "fullRobot" | "driveTrain", file: File) => {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("type", type);

  try {
    const response = await fetch("https://api.frc695.com/api/upload/upload", {
      method: "POST",
      body: formData,
    });
    const data = await response.json();
    const imageData: ImageData = {
      url: data.url,
      name: file.name,
      size: file.size,
    };
    if (type === "fullRobot") {
      fullRobotImages.value.push(imageData);
    } else {
      driveTrainImages.value.push(imageData);
    }
    saveImagesToLocalStorage();
  } catch (error) {
    console.error("Error uploading image:", error);
    Swal.fire(
      "Upload Error",
      "There was an error uploading the image. Please try again.",
      "error"
    );
  }
};

const confirmRemoveImage = (
  type: "fullRobot" | "driveTrain",
  index: number
) => {
  Swal.fire({
    title: "Are you sure?",
    text: "You are about to delete this image. This action cannot be undone.",
    icon: "warning",
    showCancelButton: true,
    confirmButtonColor: "#d33",
    cancelButtonColor: "#3085d6",
    confirmButtonText: "Yes, delete it!",
    reverseButtons: true,
  }).then((result) => {
    if (result.isConfirmed) {
      removeImage(type, index);
      Swal.fire("Deleted!", "The image has been deleted.", "success");
    }
  });
};

const removeImage = (type: "fullRobot" | "driveTrain", index: number) => {
  if (type === "fullRobot") {
    fullRobotImages.value.splice(index, 1);
  } else {
    driveTrainImages.value.splice(index, 1);
  }
  saveImagesToLocalStorage();
  // In a real application, you would also delete the image from your backend here
};

const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
};

const saveFormData = () => {
  tabs.value[currentTab.value].formData = formFields.value;
  localStorage.setItem(
    `formData_${currentFormId.value}`,
    JSON.stringify(formFields.value)
  );
};

const saveImagesToLocalStorage = () => {
  localStorage.setItem(
    `fullRobotImages_${currentFormId.value}`,
    JSON.stringify(fullRobotImages.value)
  );
  localStorage.setItem(
    `driveTrainImages_${currentFormId.value}`,
    JSON.stringify(driveTrainImages.value)
  );
};

const loadImagesFromLocalStorage = () => {
  const savedFullRobotImages = localStorage.getItem(
    `fullRobotImages_${currentFormId.value}`
  );
  const savedDriveTrainImages = localStorage.getItem(
    `driveTrainImages_${currentFormId.value}`
  );

  if (savedFullRobotImages) {
    fullRobotImages.value = JSON.parse(savedFullRobotImages);
  } else {
    fullRobotImages.value = [];
  }

  if (savedDriveTrainImages) {
    driveTrainImages.value = JSON.parse(savedDriveTrainImages);
  } else {
    driveTrainImages.value = [];
  }
};

const saveToLocalStorage = () => {
  localStorage.setItem("surveyTabs", JSON.stringify(tabs.value));
  localStorage.setItem("currentTab", currentTab.value.toString());
  saveFormData();
  saveImagesToLocalStorage();
};

const loadFromLocalStorage = () => {
  const savedTabs = localStorage.getItem("surveyTabs");
  const savedCurrentTab = localStorage.getItem("currentTab");
  if (savedTabs) {
    tabs.value = JSON.parse(savedTabs);
    currentTab.value = savedCurrentTab ? parseInt(savedCurrentTab) : 0;
    formFields.value = tabs.value[currentTab.value].formData;
  }
  loadImagesFromLocalStorage();
};

const isAllowedImageType = (file: File): boolean => {
  const allowedTypes = ["image/jpeg", "image/png", "image/gif", "image/heic"];
  return allowedTypes.includes(file.type);
};

const validateField = (field: FormField) => {
  if (field.required) {
    if (field.type === "radio" || field.type === "checkbox") {
      if (
        !field.value ||
        (Array.isArray(field.value) && field.value.length === 0)
      ) {
        field.error = "This field is required";
        return false;
      }
      if (
        (field.value === "Other" ||
          (Array.isArray(field.value) && field.value.includes("Other"))) &&
        !field.otherValue
      ) {
        field.error = "Please specify the other option";
        return false;
      }
    } else if (!field.value) {
      field.error = "This field is required";
      return false;
    }
  }
  field.error = undefined;
  return true;
};

const validateForm = (): boolean => {
  let isValid = true;
  formFields.value.forEach((field) => {
    if (!validateField(field)) {
      isValid = false;
    }
  });
  return isValid;
};

const confirmSubmitForm = () => {
  if (validateForm()) {
    Swal.fire({
      title: "Submit Form",
      text: "Are you sure you want to submit this form?",
      icon: "question",
      showCancelButton: true,
      confirmButtonColor: "#3085d6",
      cancelButtonColor: "#d33",
      confirmButtonText: "Yes, submit it!",
      reverseButtons: true,
    }).then((result) => {
      if (result.isConfirmed) {
        submitForm();
      }
    });
  } else {
    Swal.fire(
      "Validation Error",
      "Please fill in all required fields before submitting.",
      "error"
    );
  }
};

const submitForm = async () => {
  try {
    // 处理包含 "Other" 选项的字段
    const processedTabs = tabs.value.map((tab) => {
      const processedFormData = tab.formData.map((field) => {
        if (field.type === "radio" || field.type === "checkbox") {
          if (Array.isArray(field.value)) {
            field.value = field.value.map((val) =>
              val === "Other" ? field.otherValue : val
            );
          } else if (field.value === "Other") {
            field.value = field.otherValue;
          }
        }
        return field;
      });
      return { ...tab, formData: processedFormData };
    });

    const response = await fetch("https://api.frc695.com/api/survey/submit", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        eventId: eventId.value,
        tabs: processedTabs,
      }),
    });

    const data = await response.json();
    if (response.ok) {
      console.log("Form submitted:", data);

      // 清除本地存储中的表单数据和图片数据
      localStorage.removeItem(`formData_${currentFormId.value}`);
      localStorage.removeItem(`fullRobotImages_${currentFormId.value}`);
      localStorage.removeItem(`driveTrainImages_${currentFormId.value}`);

      // 重置表单字段和图片
      formFields.value = formFields.value.map((field) => ({
        ...field,
        value: null,
        error: undefined,
      }));
      fullRobotImages.value = [];
      driveTrainImages.value = [];

      // 显示成功消息
      Swal.fire("Success!", "Form submitted successfully!", "success");

      // 删除当前标签页及其所有内容
      removeTab(currentTab.value);
    } else {
      throw new Error(data.error || "Failed to submit form");
    }
  } catch (error) {
    console.error("Error submitting form:", error);
    Swal.fire(
      "Submission Error",
      "There was an error submitting the form. Please try again.",
      "error"
    );
  }
};
</script>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.5s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
